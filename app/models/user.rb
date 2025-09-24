class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  with_options if: :profile_completed? do
    validates :username, presence: true, uniqueness: true
    validates :full_name, :company, :work_location, :department, presence: true
  end

  has_many :pins, dependent: :destroy
  has_many :posts, dependent: :destroy

  # Followers / Following
  has_many :following_relationships,
            class_name: "Follow",
            foreign_key: :follower_id,
            dependent: :destroy
  has_many :following, through: :following_relationships, source: :followed

  has_many :follower_relationships,
            class_name: "Follow",
            foreign_key: :followed_id,
            dependent: :destroy
  has_many :followers, through: :follower_relationships, source: :follower

  has_one_attached :avatar
end
